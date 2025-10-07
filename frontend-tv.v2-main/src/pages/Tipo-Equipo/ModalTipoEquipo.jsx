import React, { useEffect, useState } from "react";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import Swal from "sweetalert2";

import ModalComponent from "../../components/ModalComponent/ModalComponent";
import api from "../../utils/api";

const TipoEquipoSchema = Yup.object().shape({
    tipoNombre: Yup.string().trim().required("El nombre es obligatorio"),
});

const ModalTipoEquipo = ({
    itemId,
    modalOpen,
    setModalOpen,
    title = "Editar tipo de equipo",
    refreshList,
}) => {
    const [initialValues, setInitialValues] = useState({ tipoNombre: "" });
    const [isLoading, setIsLoading] = useState(false);
    const [fetchError, setFetchError] = useState(null);

    useEffect(() => {
        if (!modalOpen) {
            setInitialValues({ tipoNombre: "" });
            setFetchError(null);
            return;
        }

        if (!itemId) {
            setFetchError("No se encontró el tipo de equipo.");
            return;
        }

        setIsLoading(true);
        setFetchError(null);

        api
            .getIdTipoEquipo(itemId)
            .then((response) => {
                const data = response?.data;
                setInitialValues({ tipoNombre: data?.tipoNombre || "" });
            })
            .catch(() => {
                setFetchError(
                    "No se pudo obtener la información del tipo de equipo."
                );
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, [itemId, modalOpen]);

    if (!modalOpen) return null;

    return (
        <ModalComponent
            modalOpen={modalOpen}
            title={title}
            setModalOpen={setModalOpen}
        >
            {isLoading ? (
                <div className="form__group" style={{ margin: "24px 0", textAlign: "center" }}>
                    Cargando información…
                </div>
            ) : fetchError ? (
                <div className="form__group-error" style={{ margin: "24px 0" }}>
                    {fetchError}
                </div>
            ) : (
                <Formik
                    enableReinitialize
                    initialValues={initialValues}
                    validationSchema={TipoEquipoSchema}
                    onSubmit={async (values, { setSubmitting }) => {
                        const normalized = values.tipoNombre.trim().toLowerCase();

                        try {
                            await api.updateTipoEquipo(itemId, {
                                tipoNombre: normalized,
                            });

                            Swal.fire({
                                title: "Tipo de equipo actualizado",
                                icon: "success",
                                html: `<p><strong>Tipo:</strong> ${normalized}</p>`,
                            });

                            if (typeof refreshList === "function") {
                                await refreshList();
                            }

                            setModalOpen(false);
                        } catch (error) {
                            Swal.fire({
                                title: "Error",
                                icon: "error",
                                text: "No se pudo actualizar el tipo de equipo",
                                footer: `${error?.response?.data?.message || "Error desconocido"}`,
                            });
                        } finally {
                            setSubmitting(false);
                        }
                    }}
                >
                    {({ isSubmitting }) => (
                        <Form className="form form__modal">
                            <div className="form__group">
                                <label className="form__group-label">
                                    Nombre tipo de equipo
                                    <br />
                                    <Field
                                        name="tipoNombre"
                                        type="text"
                                        className="form__group-input"
                                        placeholder="Tipo de equipo"
                                    />
                                    <ErrorMessage
                                        name="tipoNombre"
                                        component="div"
                                        className="form__group-error"
                                    />
                                </label>
                            </div>

                            <div className="form__group">
                                <button
                                    type="submit"
                                    className="button btn-primary"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? "Guardando..." : "Guardar"}
                                </button>
                            </div>
                        </Form>
                    )}
                </Formik>
            )}
        </ModalComponent>
    );
};

export default ModalTipoEquipo;
