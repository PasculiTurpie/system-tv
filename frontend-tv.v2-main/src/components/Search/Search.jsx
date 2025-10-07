import "./Search.css";
import * as Yup from "yup";
import Swal from "sweetalert2";

import { Field, Form, Formik } from "formik";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const SchemaSearch = Yup.object().shape({
    searchFilter: Yup.string().trim(
        "No debe tener espacios al inicio o al final"
    ),
});

const Search = () => {
    const [searchFilterData, setSearchFilterData] = useState("");
    const navigate = useNavigate()

    return (
        <>
            <Formik
                initialValues={{
                    searchFilter: "",
                }}
                validationSchema={SchemaSearch}
                onSubmit={async (values, { resetForm }) => {
                    try {
                        setSearchFilterData(values);
                        navigate(`/search?keyword=${searchFilterData}`)
                        resetForm();
                    } catch (error) {
                        console.error(error);
                    }
                }}
            >
                <Form className="form__search">
                    <Field name="searchFilter">
                        {({ field, form }) => (
                            <input
                                {...field}
                                className="input__text-search"
                                type="text"
                                placeholder="Buscar"
                                onChange={(e) => {
                                    const value = e.target.value;
                                    form.setFieldValue("searchFilter", value);
                                    setSearchFilterData(value);
                                }}
                            />
                        )}
                    </Field>
                </Form>
            </Formik>
        </>
    );
};

export default Search;
